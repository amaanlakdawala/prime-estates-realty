import './globals.css';
import { PLATFORM_NAME } from '@/lib/site';

// Each firm's website sets its own title in app/[firm]/layout.js; this covers sign-in and admin.
export const metadata = {
  title: { default: PLATFORM_NAME, template: `%s | ${PLATFORM_NAME}` },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en-IN" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* Netlify inserts a line break and a comment into <head> on the live site. React then rejects the
            server HTML (error #418) and re-renders the whole page, so remove them before React starts. */}
        {/* Also marks the page as running JavaScript, so scroll-reveal content starts hidden (see globals.css). */}
        <script dangerouslySetInnerHTML={{ __html: 'for(const n of [...document.head.childNodes])if(n.nodeType!==1)n.remove();document.documentElement.classList.add("js")' }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
