import { ExtLink } from "./ui-elements/buttons"

export const Footer = ({ className = "" }) => {
  return (
    <div className={`py-16 text-right ${className}`}>
      <p>
        © 2025 by{" "}
        <ExtLink href="https://danielmarcus.de/">Daniel Marcus</ExtLink> |{" "}
        <ExtLink href="https://github.com/daniel-marcus/neuralnetvis">
          Github
        </ExtLink>
      </p>
      <p className="mt-4"></p>
    </div>
  )
}
