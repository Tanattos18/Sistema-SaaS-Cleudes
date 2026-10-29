import type { Metadata, Viewport } from "next";
import { Baloo_2, Nunito_Sans } from "next/font/google";
import { RegistrarServiceWorker } from "@/components/registrar-sw";
import "./globals.css";

// Baloo: títulos arredondados e fortes, como o letreiro da fachada. Nunito Sans: leitura no celular.
const titulos = Baloo_2({ variable: "--font-titulos", subsets: ["latin"], weight: ["600", "700", "800"] });
const texto = Nunito_Sans({ variable: "--font-texto", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pedidos online",
  description: "Faça seu pedido no mercado do bairro e receba em casa",
  icons: { apple: "/icones/apple-touch-icon.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Pedidos" },
};

export const viewport: Viewport = {
  themeColor: "#ffd200",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${titulos.variable} ${texto.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        {children}
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
