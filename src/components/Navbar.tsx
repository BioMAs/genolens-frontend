'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { Menu, X, User as UserIcon, LogOut, Shield, Moon, Sun } from 'lucide-react'
import QuotaDisplay from './QuotaDisplay'
import GlobalGeneSearch from './GlobalGeneSearch'
import { useTheme } from '@/contexts/ThemeContext'

interface NavbarProps {
  user: User | null
  userRole: string | null
}

export default function Navbar({ user, userRole }: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const pathname = usePathname()
  const isAdmin = userRole?.toLowerCase() === 'admin'
  const { theme, toggleTheme } = useTheme()

  // Hide navbar for non-authenticated users
  if (!user) {
    return null
  }

  return (
    <nav className="bg-white dark:bg-gray-900 shadow-sm sticky top-0 z-50 transition-colors">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 gap-4">
          <div className="flex items-center gap-4 flex-shrink-0">
            <Link href="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="GenoLens Next" className="h-10 w-auto" />
            </Link>
          </div>

          {/* Global Gene Search - Desktop */}
          <div className="hidden md:flex items-center flex-1 max-w-2xl">
            <GlobalGeneSearch />
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-4 flex-shrink-0">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title={theme === 'light' ? 'Activer le mode sombre' : 'Activer le mode clair'}
            >
              {theme === 'light' ? (
                <Moon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
              ) : (
                <Sun className="h-5 w-5 text-gray-600 dark:text-gray-300" />
              )}
            </button>
            
            <Link
              href="/dashboard"
              className="text-gray-600 dark:text-gray-300 hover:text-brand-primary dark:hover:text-brand-secondary px-3 py-2 rounded-md text-sm font-medium"
            >
              Dashboard
            </Link>
            <div className="flex items-center px-2">
              <QuotaDisplay />
            </div>
            <Link
              href="/profile"
              className="text-gray-600 dark:text-gray-300 hover:text-brand-primary dark:hover:text-brand-secondary px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2"
            >
              <UserIcon className="h-4 w-4" />
              Profile
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 bg-red-50 dark:bg-red-950"
              >
                <Shield className="h-4 w-4" />
                Admin
              </Link>
            )}
            <div className="flex items-center gap-4 ml-4 pl-4 border-l border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400">{user.email}</span>
              <form action="/auth/signout" method="post">
                <button
                  className="text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                  type="submit"
                  title="Sign out"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </form>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title={theme === 'light' ? 'Activer le mode sombre' : 'Activer le mode clair'}
            >
              {theme === 'light' ? (
                <Moon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
              ) : (
                <Sun className="h-5 w-5 text-gray-600 dark:text-gray-300" />
              )}
            </button>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 p-2"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {/* Mobile Gene Search */}
            <div className="px-3 py-2">
              <GlobalGeneSearch />
            </div>
            
            <Link
              href="/dashboard"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:text-brand-primary dark:hover:text-brand-secondary hover:bg-gray-50 dark:hover:bg-gray-800"
              onClick={() => setIsMenuOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              href="/profile"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:text-brand-primary dark:hover:text-brand-secondary hover:bg-gray-50 dark:hover:bg-gray-800"
              onClick={() => setIsMenuOpen(false)}
            >
              Profile
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-50 dark:bg-red-950"
                onClick={() => setIsMenuOpen(false)}
              >
                <Shield className="h-5 w-5" />
                Admin
              </Link>
            )}
            <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800 mt-2">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{user.email}</p>
              <form action="/auth/signout" method="post">
                <button
                  className="w-full text-left text-red-600 dark:text-red-400 font-medium py-2"
                  type="submit"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
