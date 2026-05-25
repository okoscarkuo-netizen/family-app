import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const isLoginPage = request.nextUrl.pathname === '/login'
  const isAuthCallback = request.nextUrl.pathname.startsWith('/auth/')
  const isPublicAsset =
    request.nextUrl.pathname === '/manifest.webmanifest' ||
    request.nextUrl.pathname === '/sw.js' ||
    request.nextUrl.pathname.startsWith('/_next/') ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|js|css|map)$/i.test(request.nextUrl.pathname)
  const isPublicRoute =
    isLoginPage ||
    isAuthCallback ||
    isPublicAsset ||
    request.nextUrl.pathname.startsWith('/api/cron/') ||
    request.nextUrl.pathname === '/api/sentry-test'

  const hasAuthCookie = request.cookies.getAll().some((cookie) => cookie.name.includes('auth-token'))

  if (isLoginPage && hasAuthCookie) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  if (isPublicRoute) {
    return NextResponse.next()
  }

  if (!hasAuthCookie) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|js|css|map)$).*)',
  ],
}
