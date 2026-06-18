import "./globals.css";

export const metadata = {
  title: "Metro de Proyectos · COFERSA",
  description: "Centro de Control de Sistemas — seguimiento de proyectos por pilar estratégico.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
