import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CanvasFlow — Academic Task Assistant',
  description:
    'Your personal academic command center. Track assignments, quizzes, deadlines, and submissions from ELTE Canvas in one clean dashboard.',
  keywords: ['canvas', 'elte', 'academic', 'tasks', 'deadlines', 'assignments'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
