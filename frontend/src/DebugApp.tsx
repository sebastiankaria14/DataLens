import './index.css';

function DebugApp() {
  console.log('DebugApp is rendering');
  
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1 style={{ color: 'red', fontSize: '48px' }}>DEBUG MODE</h1>
      <p style={{ fontSize: '24px' }}>If you can see this, React is working!</p>
      <div style={{ background: 'lightblue', padding: '20px', marginTop: '20px' }}>
        <p>Current time: {new Date().toLocaleTimeString()}</p>
      </div>
    </div>
  );
}

export default DebugApp;
