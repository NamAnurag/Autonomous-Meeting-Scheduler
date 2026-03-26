import "./globals.css";

export const metadata = {
  title: "AI Meeting Assistant",
  description: "AI-powered meeting scheduling assistant",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}