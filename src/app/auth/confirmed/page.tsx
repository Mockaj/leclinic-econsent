import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2 } from 'lucide-react'

export default function AuthConfirmedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-950">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
            <CheckCircle2 className="h-10 w-10 text-green-500 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl">Email byl úspěšně ověřen</CardTitle>
          <CardDescription>
            Váš účet byl aktivován. Nyní se můžete přihlásit.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button asChild className="w-full">
            <Link href="/login">Přejít na přihlášení</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
