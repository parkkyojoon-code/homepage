import '@/components/lectures/lecture-site.css'

export default function LecturesLayout({children}:{children:React.ReactNode}) {
  return <div className="lecture-site">{children}</div>
}
