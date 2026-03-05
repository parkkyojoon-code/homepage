import Hero from "@/components/home/Hero"
import CourseCards from "@/components/home/CourseCards"
import Stats from "@/components/home/Stats"
import TargetAudience from "@/components/home/TargetAudience"
import TypingEffect from "@/components/home/TypingEffect"
import ReviewScroll from "@/components/home/ReviewScroll"
import WhyParkGyoJun from "@/components/home/WhyParkGyoJun"
import ManagementSystem from "@/components/home/ManagementSystem"
import CourseConsultation from "@/components/home/CourseConsultation"
import MediaSection from "@/components/home/MediaSection"
import FAQ from "@/components/home/FAQ"
import FinalCTA from "@/components/home/FinalCTA"
import Footer from "@/components/layout/Footer"
import NotificationSystem from "@/components/NotificationSystem"

export default function Home() {
  return (
    <main className="min-h-screen">
      <Hero />
      <Stats />
      <TargetAudience />
      <TypingEffect />
      <ReviewScroll />
      <WhyParkGyoJun />
      <ManagementSystem />
      <CourseCards />
      <CourseConsultation />
      <MediaSection />
      <FAQ />
      <FinalCTA />
      <Footer />
      <NotificationSystem />
    </main>
  )
}
