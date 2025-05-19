import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { Auth } from './components/auth';

function App() {
  return (
    <div className="App">
      <Auth />
    </div>
  );
}

export default App;