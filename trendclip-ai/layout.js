import "./globals.css";
export const metadata = { title: "TrendClip AI", description: "Turn your own footage into trend-ready short videos." };
export default function RootLayout({ children }) {
  return (<html lang="en"><body className="min-h-screen">{children}</body></html>);
}
