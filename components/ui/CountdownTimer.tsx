"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"

interface CountdownTimerProps {
  targetDate?: Date
  className?: string
}

export default function CountdownTimer({ targetDate, className }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState({
    hours: 23,
    minutes: 59,
    seconds: 59,
  })

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime()
      const target = targetDate ? targetDate.getTime() : now + 24 * 60 * 60 * 1000 // 24 hours from now
      const difference = target - now

      if (difference > 0) {
        setTimeLeft({
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000),
        })
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [targetDate])

  return (
    <div className={className}>
      <div className="flex items-center justify-center gap-4">
        <motion.div
          className="text-center"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="bg-urgent/10 rounded-lg px-4 py-2">
            <span className="text-3xl font-bold text-urgent">
              {String(timeLeft.hours).padStart(2, "0")}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">시간</p>
        </motion.div>

        <span className="text-2xl font-bold text-urgent">:</span>

        <motion.div
          className="text-center"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="bg-urgent/10 rounded-lg px-4 py-2">
            <span className="text-3xl font-bold text-urgent">
              {String(timeLeft.minutes).padStart(2, "0")}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">분</p>
        </motion.div>

        <span className="text-2xl font-bold text-urgent">:</span>

        <motion.div
          className="text-center"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="bg-urgent/10 rounded-lg px-4 py-2">
            <span className="text-3xl font-bold text-urgent">
              {String(timeLeft.seconds).padStart(2, "0")}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">초</p>
        </motion.div>
      </div>
    </div>
  )
}