import { renderToStaticMarkup } from "react-dom/server";
import { ClientContext } from "./src/namurui/client-context";

const html = renderToStaticMarkup(<ClientContext />);
console.log(html);
