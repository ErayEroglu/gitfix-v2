'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

const AuthClientComponent = () => {
    const { data: session } = useSession()
    const router = useRouter()

    // if logged in, proceed to search page, else go to home page
    useEffect(() => {
        if (session) {
            router.push('/Search')
        } else {
            router.push('/')
        }
    }, [session, router])
    return null // no need to render anything
}
export default AuthClientComponent
