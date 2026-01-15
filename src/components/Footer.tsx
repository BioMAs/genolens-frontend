import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-brand-primary text-white py-8 mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center">
                <span className="text-brand-primary font-bold text-lg">G</span>
              </div>
              <span className="text-xl font-bold">GenoLens Next</span>
            </div>
            <p className="text-gray-300 text-sm">
              Advanced genomic data visualization and analysis platform.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4 text-brand-secondary">Resources</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li><Link href="#" className="hover:text-white transition-colors">Documentation</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">API Reference</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Support</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4 text-brand-secondary">Legal</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li><Link href="#" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-700 mt-8 pt-8 text-center text-sm text-gray-400">
          &copy; {new Date().getFullYear()} GenoLens. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
