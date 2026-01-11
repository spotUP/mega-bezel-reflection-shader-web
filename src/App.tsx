import ShaderTest from "./pages/ShaderTest";
import "./index.css";

const App = () => (
  <div style={{ minHeight: "100vh", background: "#0b0b0f", color: "#f4f4f4" }}>
    <header style={{ padding: "24px" }}>
      <h1 style={{ margin: 0, fontSize: "24px" }}>Mega Bezel Reflection Shader</h1>
      <p style={{ margin: "8px 0 0", opacity: 0.7 }}>
        Web demo for the Mega Bezel reflection shader pipeline.
      </p>
    </header>
    <main style={{ padding: "0 24px 24px" }}>
      <ShaderTest />
    </main>
  </div>
);

export default App;
