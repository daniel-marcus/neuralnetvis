export const Footer = ({ className = "" }) => {
  return (
    <div className={`my-16 text-right ${className}`}>
      <p>
        © 2025 by{" "}
        <a
          className="text-accent hover:text-white"
          target="_blank"
          href="https://danielmarcus.de/"
        >
          Daniel Marcus
        </a>{" "}
        |{" "}
        <a
          className="text-accent hover:text-white"
          href="https://github.com/daniel-marcus/neuralnetvis"
          target="_blank"
        >
          Github
        </a>
      </p>
      <p className="mt-4"></p>
    </div>
  )
}
