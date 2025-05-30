import './App.css'
import { Auth } from './components/auth'
import Header from './components/header'
import Footer from './components/footer'

function App() {
  return (
    <div className="App">
      <Header />
      <Auth />
      <Footer />
    </div>
  );
}

export default App;