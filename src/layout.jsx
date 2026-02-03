import { Outlet } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';

export const Layout = () => {
  return (
    <>
      <Header />
      <main className="px-5 py-6 min-h-screen">
        <Outlet />
      </main>
      <Footer />
    </>
  );
};