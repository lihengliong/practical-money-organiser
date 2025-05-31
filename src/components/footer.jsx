import './stylesheets/footer.css';

function Footer() {
    return(
        <footer className="footer">
            <p>&copy; {new Date().getFullYear()} Practical Money Organiser</p>
        </footer>
    );
}

export default Footer;