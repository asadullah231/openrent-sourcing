import { redirect } from 'next/navigation';

// Root ab dashboard pe jata hai (13 Aug directive): app ka primary entry point
// Orders → Find Properties hai, generic Search nahi. Purana search page /search
// pe zinda hai — delete nahi hua, sirf home nahi raha.
export default function Home() {
  redirect('/dashboard');
}
