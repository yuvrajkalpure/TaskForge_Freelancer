import './globals.css';
import Providers from './providers';

export const metadata = {
  title: 'TaskForge — Freelance Project Marketplace',
  description: 'Post projects, place competitive bids, hire verified freelancers, and build reviews.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
