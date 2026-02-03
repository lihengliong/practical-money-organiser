import { Outlet } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';

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