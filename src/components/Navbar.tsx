'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { Menu, X, User as UserIcon, LogOut, Shield } from 'lucide-react'
import QuotaDisplay from './QuotaDisplay'

interface NavbarProps {
  user: User | null
  userRole: string | null
}

export default function Navbar({ user, userRole }: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const pathname = usePathname()
  const isAdmin = userRole?.toLowerCase() === 'admin'

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-brand-primary flex items-center justify-center">
                <span className="text-white font-bold text-lg">G</span>
              </div>
              <span className="text-xl font-bold tracking-tight text-gray-900">
                <span className="text-brand-primary">Geno</span><span className="text-brand-secondary">Lens</span> Next
              </span>
            </Link>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-gray-600 hover:text-brand-primary px-3 py-2 rounded-md text-sm font-medium"
                >
                  Dashboard
                </Link>
                <div className="flex items-center px-2">
                  <QuotaDisplay />
                </div>
                <Link
                  href="/profile"
                  className="text-gray-600 hover:text-brand-primary px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2"
                >
                  <UserIcon className="h-4 w-4" />
                  Profile
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="text-red-600 hover:text-red-700 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 bg-red-50"
                  >
                    <Shield className="h-4 w-4" />
                    Admin
                  </Link>
                )}
                <div className="flex items-center gap-4 ml-4 pl-4 border-l border-gray-200">
                  <span className="text-sm text-gray-500">{user.email}</span>
                  <form action="/auth/signout" method="post">
                    <button
                      className="text-gray-500 hover:text-red-600 transition-colors p-2 rounded-full hover:bg-gray-100"
                      type="submit"
                      title="Sign out"
                    >
                      <LogOut className="h-5 w-5" />
                    </button>
                  </form>
                </div>
              </>
            ) : (
              pathname !== '/login' && (
                <Link
                  href="/login"
                  className="bg-brand-primary text-white hover:bg-brand-primary/90 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Sign In
                </Link>
              )
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-500 hover:text-gray-900 p-2"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-brand-primary hover:bg-gray-50"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Dashboard
                </Link>
                <Link
                  href="/profile"
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-brand-primary hover:bg-gray-50"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Profile
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-red-600 hover:text-red-700 bg-red-50"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Shield className="h-5 w-5" />
                    Admin
                  </Link>
                )}
                <div className="px-3 py-2 border-t border-gray-100 mt-2">
                  <p className="text-sm text-gray-500 mb-2">{user.email}</p>
                  <form action="/auth/signout" method="post">
                    <button
                      className="w-full text-left text-red-600 font-medium py-2"
                      type="submit"
                    >
                      Sign out
                    </button>
                  </form>
                </div>
              </>
            ) : (
              pathname !== '/login' && (
                <Link
                  href="/login"
                  className="block w-full text-center bg-brand-primary text-white px-4 py-2 rounded-md text-base font-medium hover:bg-brand-primary/90"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Sign In
                </Link>
              )
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
