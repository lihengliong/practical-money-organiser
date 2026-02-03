function Footer() {
  return (
    <footer className="bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-center
                       py-4 px-8 w-screen shadow-[0_-2px_10px_rgba(0,0,0,0.1)]
                       relative overflow-x-hidden md:px-4">
      <p className="m-0 text-sm font-medium">
        &copy; {new Date().getFullYear()} Practical Money Organiser
      </p>
    </footer>
  );
}

export default Footer;
