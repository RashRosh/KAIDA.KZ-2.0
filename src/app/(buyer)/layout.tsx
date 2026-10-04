import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import '@fontsource/geologica/400.css';
import '@fontsource/geologica/500.css';
import '@fontsource/geologica/600.css';
import '@fontsource/geologica/700.css';
import '../seller/kaida.css';
import '../seller/kaida-app.css';
import './_ui/first-entry.css';

// buyer-screens-mockup: the buyer screens are built from the accepted mockup (B01, B02) and its classes, in the same
// phone column as the seller app. No language screen intercepts a route: the language is the saved choice, else the
// browser's, else Russian (stage 6B).
export default function BuyerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
