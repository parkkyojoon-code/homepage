import Hero from "@/components/home/Hero"
import CourseCards from "@/components/home/CourseCards"
import Stats from "@/components/home/Stats"
import TargetAudience from "@/components/home/TargetAudience"
import TypingEffect from "@/components/home/TypingEffect"
import ReviewScroll from "@/components/home/ReviewScroll"
import InstructorIntro2 from "@/components/home/InstructorIntro2"
import WhyParkGyoJun from "@/components/home/WhyParkGyoJun"
import ManagementSystem from "@/components/home/ManagementSystem"
import MediaSection from "@/components/home/MediaSection"
import FinalCTA from "@/components/home/FinalCTA"
import FAQ from "@/components/home/FAQ"
import NotificationSystem from "@/components/NotificationSystem"

export default function Home() {
  return (
    <main className="min-h-screen">
      <Hero />
      <Stats />
      <TargetAudience />
      <TypingEffect />
      <ReviewScroll />
      <InstructorIntro2 />
      <WhyParkGyoJun />
      <ManagementSystem />
      <CourseCards />
      <MediaSection />
      <FinalCTA />
      <FAQ />
      <NotificationSystem />
    </main>
  )
}