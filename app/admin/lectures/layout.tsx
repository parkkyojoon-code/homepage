import '@/components/lectures/lecture-site.css'

export default function LectureAdminLayout({children}:{children:React.ReactNode}) {
  return <div className="lecture-site">{children}</div>
}
