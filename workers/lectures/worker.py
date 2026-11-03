"""Isolated lecture billing worker. No Sheets access, no database credentials, no destroy/refund calls."""
import argparse
import hashlib
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

PAYS_BASE = "https://erp-api.payssam.kr"


class TransportFailure(Exception):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class HttpJson:
    def __init__(self):
        self.opener = urllib.request.build_opener(NoRedirect())

    def post(self, url, body, token=None):
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if token:
            headers["Authorization"] = "Bearer " + token
        request = urllib.request.Request(url, data=json.dumps(body, ensure_ascii=False).encode("utf-8"), headers=headers, method="POST")
        try:
            with self.opener.open(request, timeout=15) as response:
                if response.status != 200:
                    raise TransportFailure("HTTP_FAILED")
                raw = response.read(65537)
                if len(raw) > 65536:
                    raise TransportFailure("RESPONSE_TOO_LARGE")
                result = json.loads(raw)
                if not isinstance(result, dict):
                    raise TransportFailure("INVALID_RESPONSE")
                return result
        except Exception:
            # Never include request/response bodies, URLs or provider error text in logs.
            raise TransportFailure("REQUEST_FAILED") from None


def origin(value):
    parsed = urllib.parse.urlsplit(value)
    local = parsed.hostname in ("127.0.0.1", "localhost", "::1")
    if (parsed.scheme != "https" and not (parsed.scheme == "http" and local)) or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ("", "/"):
        raise ValueError("INVALID_WEB_ORIGIN")
    return value.rstrip("/")


class PaySsamV1:
    def __init__(self, transport, api_key, member, merchant, callback_url=None):
        if not all((api_key, member, merchant)):
            raise ValueError("PROVIDER_CONFIGURATION_REQUIRED")
        self.transport = transport
        self.account = {"apikey": api_key, "member": member, "merchant": merchant}
        self.callback_url = callback_url

    def account_matches(self, response):
        return all(key not in response or response[key] == value for key, value in self.account.items())

    def send(self, job):
        try:
            bill_id, amount, phone = job["billId"], job["amountWon"], job["recipientPhone"]
            if not re.fullmatch(r"L[0-9a-f]{19}", bill_id) or type(amount) is not int or not 0 < amount <= 2147483647 or not re.fullmatch(r"010\d{8}", phone):
                return {"outcome": "UNKNOWN"}
            parsed = urllib.parse.urlsplit(self.callback_url or "")
            if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.fragment:
                return {"outcome": "UNKNOWN"}
            digest = hashlib.sha256(f"{bill_id},{phone},{amount}".encode()).hexdigest()
            bill = {"bill_id": bill_id, "product_nm": job["productName"], "member_nm": job["recipientName"],
                    "phone": phone, "price": str(amount), "hash": digest, "message": "온라인 강의 수강료 안내",
                    "expire_dt": (datetime.now(timezone(timedelta(hours=9))) + timedelta(days=7)).date().isoformat(),
                    "callbackURL": self.callback_url}
            response = self.transport.post(PAYS_BASE + "/if/bill/send", {**self.account, "bill": bill})
            if response.get("code") == "0000" and response.get("bill_id") == bill_id and self.account_matches(response) and response.get("hash", digest) == digest:
                return {"outcome": "SENT"}
        except Exception:
            pass
        # Includes timeouts and duplicate/unknown provider codes. Never send again automatically.
        return {"outcome": "UNKNOWN"}

    def read(self, job):
        unknown = {"state": "ERROR", "amountWon": None, "echoedBillId": None}
        try:
            response = self.transport.post(PAYS_BASE + "/if/bill/read", {**self.account, "bill_id": job["billId"]})
            if not self.account_matches(response) or response.get("code") not in (None, "0000"):
                return unknown
            state, bill_id = response.get("appr_state"), response.get("bill_id")
            if state not in ("F", "W", "C", "D") or bill_id != job["billId"]:
                return unknown
            price = str(response.get("appr_price", ""))
            amount = int(price) if re.fullmatch(r"\d{1,10}", price) else None
            if amount is not None and not 0 < amount <= 2147483647:
                amount = None
            if state == "F" and amount is None:
                return unknown
            return {"state": state, "amountWon": amount, "echoedBillId": bill_id}
        except Exception:
            return unknown


class Worker:
    def __init__(self, transport, web_origin, token, provider, send_enabled=False):
        self.transport, self.web, self.token, self.provider = transport, origin(web_origin), token, provider
        self.send_enabled = send_enabled
        if len(token) < 32:
            raise ValueError("WORKER_TOKEN_REQUIRED")

    def internal(self, action, body):
        return self.transport.post(self.web + "/api/lectures/internal/billing/" + action, body, self.token)

    def cycle(self, batch=5):
        count = 0
        for kind in (["SEND", "READ"] if self.send_enabled else ["READ"]):
            for _ in range(batch):
                job = self.internal("claim", {"kind": kind}).get("job")
                if not job:
                    break
                report = {"kind": kind, "orderId": job["orderId"], "billId": job["billId"], "claimToken": job["claimToken"]}
                report.update(self.provider.send(job) if kind == "SEND" else self.provider.read(job))
                # Only report delivery is retried, with the EXACT same report/claim token.
                for attempt in range(3):
                    try:
                        self.internal("result", report)
                        break
                    except TransportFailure:
                        if attempt == 2:
                            raise
                        time.sleep(1)
                count += 1
        return count


def configured_worker(env):
    if env.get("LECTURES_WORKER_ENABLED") != "true":
        return None
    transport = HttpJson()
    web = origin(env.get("LECTURES_WEB_ORIGIN", ""))
    sending = env.get("LECTURES_WORKER_SEND_ENABLED") == "true"
    callback = env.get("PAYSSAM_CALLBACK_URL") or web + "/api/lectures/payssam/notification"
    if sending and urllib.parse.urlsplit(callback).scheme != "https":
        raise ValueError("HTTPS_CALLBACK_REQUIRED")
    provider = PaySsamV1(transport, env.get("PAYSSAM_API_KEY"), env.get("PAYSSAM_MEMBER"), env.get("PAYSSAM_MERCHANT"), callback)
    return Worker(transport, web, env.get("LECTURES_WORKER_TOKEN", ""), provider, sending)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    try:
        worker = configured_worker(os.environ)
        if worker is None:
            print("Lecture billing worker is disabled.", flush=True)
            return
        while True:
            try:
                count = worker.cycle()
                print(f"Lecture billing cycle finished: {count} jobs.", flush=True)
            except Exception:
                print("Lecture billing cycle failed; no automatic resend.", flush=True)
            if args.once:
                return
            time.sleep(10)
    except Exception:
        print("Lecture billing configuration is invalid. No worker was started.", flush=True)
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
