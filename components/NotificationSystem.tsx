"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Users, TrendingUp, Star, Clock } from "lucide-react"

interface Notification {
  id: number
  type: "enrollment" | "achievement" | "review" | "limited"
  message: string
  icon: React.ElementType
  timestamp: Date
}

const mockNotifications: Omit<Notification, "id" | "timestamp">[] = [
  {
    type: "enrollment",
    message: "서울 강남구에서 방금 수강 신청했습니다",
    icon: Users
  },
  {
    type: "achievement",
    message: "김○○님이 6등급에서 1등급 달성!",
    icon: TrendingUp
  },
  {
    type: "review",
    message: "\"덕분에 서울대 합격했어요!\" - 이○○",
    icon: Star
  },
  {
    type: "limited",
    message: "수능 수학 완성반 마감까지 3자리 남음",
    icon: Clock
  },
  {
    type: "enrollment",
    message: "경기 성남시에서 상담 예약했습니다",
    icon: Users
  },
  {
    type: "achievement",
    message: "박○○님이 수능 만점 달성!",
    icon: TrendingUp
  },
  {
    type: "review",
    message: "\"수포자였는데 1등급 받았어요\" - 최○○",
    icon: Star
  },
  {
    type: "limited",
    message: "의대반 특별반 마감까지 2자리 남음",
    icon: Clock
  }
]

export default function NotificationSystem() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [currentNotification, setCurrentNotification] = useState<Notification | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Initialize notifications
    const initialNotifications = mockNotifications.map((n, index) => ({
      ...n,
      id: index,
      timestamp: new Date()
    }))
    setNotifications(initialNotifications)

    // Show notifications periodically
    let notificationIndex = 0
    const showNotification = () => {
      if (notificationIndex < initialNotifications.length) {
        setCurrentNotification(initialNotifications[notificationIndex])
        setIsVisible(true)
        notificationIndex++

        // Hide after 5 seconds
        setTimeout(() => {
          setIsVisible(false)
        }, 5000)

        // Show next notification after 8 seconds
        if (notificationIndex < initialNotifications.length) {
          setTimeout(showNotification, 8000)
        } else {
          // Reset and start over after 30 seconds
          setTimeout(() => {
            notificationIndex = 0
            showNotification()
          }, 30000)
        }
      }
    }

    // Start showing notifications after 3 seconds
    const initialTimeout = setTimeout(showNotification, 3000)

    return () => {
      clearTimeout(initialTimeout)
    }
  }, [])

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "enrollment":
        return "bg-blue-500"
      case "achievement":
        return "bg-green-500"
      case "review":
        return "bg-purple-500"
      case "limited":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  return (
    <AnimatePresence>
      {isVisible && currentNotification && (
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-6 right-6 z-50 max-w-sm"
        >
          <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
            <div className={`h-1 ${getNotificationColor(currentNotification.type)}`} />
            <div className="p-4">
              <div className="flex items-start space-x-3">
                <div className={`flex-shrink-0 w-10 h-10 ${getNotificationColor(currentNotification.type)} rounded-full flex items-center justify-center`}>
                  <currentNotification.icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-800 font-medium">
                    {currentNotification.message}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    방금 전
                  </p>
                </div>
                <button
                  onClick={() => setIsVisible(false)}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}