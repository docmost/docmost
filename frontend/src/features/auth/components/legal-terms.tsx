import Link from "next/link";

export default function LegalTerms(){
  return (
    <p className="px-8 text-center text-sm text-muted-foreground">
      By clicking continue, you agree to our{" "}
      <Link href="#" className="underline underline-offset-4 hover:text-primary">
        Terms of Service</Link>{" "} and{" "}
      <Link href="#" className="underline underline-offset-4 hover:text-primary">Privacy Policy</Link>.
    </p>
  )
}
