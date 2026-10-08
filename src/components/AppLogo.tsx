import { Link } from "react-router";

export default function AppLogo({
  footer = false,
  link = true,
}: {
  footer?: boolean;
  link?: boolean;
}) {
  const logo = (
    <img
      alt="MyFood"
      className={footer ? "h-[55px] w-auto" : "h-[52px] w-auto"}
      src={footer ? "/myfood-footer.png" : "/myfood-header.png"}
    />
  );
  return link ? <Link to="/">{logo}</Link> : logo;
}
