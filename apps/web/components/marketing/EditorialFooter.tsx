import Link from "next/link";

export function EditorialFooter() {
  return (
    <footer className="w-full bg-slate-50 pt-32 pb-12 border-t border-slate-200/50">
      <div className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16">
        
        {/* Top Section: Links Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 mb-32">
          
          {/* Column 1: Brand (Spans 4 cols on large screens for breathing room) */}
          <div className="lg:col-span-4 flex flex-col justify-between">
            <div>
              <Link href="/" className="inline-flex items-center gap-2 mb-8 group">
                <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-xl tracking-tighter">
                  J
                </div>
                <span className="text-xl font-bold tracking-tight text-slate-900">
                  Jesmond<span className="text-indigo-600">.</span>
                </span>
              </Link>
              <p className="text-sm text-slate-500 font-light leading-relaxed max-w-xs mb-8">
                Australia's premium student accommodation platform. Designed for certainty, built for student success.
              </p>
            </div>
            
            <div className="flex items-center gap-4 text-slate-400">
              {/* Minimal Social Icons */}
              <a href="#" className="hover:text-slate-900 transition-colors" aria-label="Instagram">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" /></svg>
              </a>
              <a href="#" className="hover:text-slate-900 transition-colors" aria-label="LinkedIn">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" clipRule="evenodd" /></svg>
              </a>
            </div>
          </div>

          {/* Column 2: Explore */}
          <div className="lg:col-span-2">
            <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-widest mb-6">Explore</h4>
            <ul className="flex flex-col gap-4 text-sm text-slate-500 font-medium">
              <li><Link href="/cities/melbourne" className="hover:text-slate-900 transition-colors">Melbourne</Link></li>
              <li><Link href="/cities/sydney" className="hover:text-slate-900 transition-colors">Sydney</Link></li>
              <li><Link href="/cities/brisbane" className="hover:text-slate-900 transition-colors">Brisbane</Link></li>
              <li><Link href="/cities/perth" className="hover:text-slate-900 transition-colors">Perth</Link></li>
              <li><Link href="/cities/adelaide" className="hover:text-slate-900 transition-colors">Adelaide</Link></li>
              <li><Link href="/cities/canberra" className="hover:text-slate-900 transition-colors">Canberra</Link></li>
            </ul>
          </div>

          {/* Column 3: Universities */}
          <div className="lg:col-span-2">
            <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-widest mb-6">Universities</h4>
            <ul className="flex flex-col gap-4 text-sm text-slate-500 font-medium">
              <li><Link href="/universities/unimelb" className="hover:text-slate-900 transition-colors">University of Melbourne</Link></li>
              <li><Link href="/universities/monash" className="hover:text-slate-900 transition-colors">Monash University</Link></li>
              <li><Link href="/universities/unsw" className="hover:text-slate-900 transition-colors">UNSW Sydney</Link></li>
              <li><Link href="/universities/uts" className="hover:text-slate-900 transition-colors">UTS</Link></li>
              <li><Link href="/universities/rmit" className="hover:text-slate-900 transition-colors">RMIT University</Link></li>
              <li><Link href="/universities/qut" className="hover:text-slate-900 transition-colors">QUT</Link></li>
            </ul>
          </div>

          {/* Column 4: Students */}
          <div className="lg:col-span-2">
            <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-widest mb-6">Students</h4>
            <ul className="flex flex-col gap-4 text-sm text-slate-500 font-medium">
              <li><Link href="/guide" className="hover:text-slate-900 transition-colors">Accommodation Guide</Link></li>
              <li><Link href="/moving" className="hover:text-slate-900 transition-colors">Moving to Australia</Link></li>
              <li><Link href="/cost" className="hover:text-slate-900 transition-colors">Cost of Living</Link></li>
              <li><Link href="/visa" className="hover:text-slate-900 transition-colors">Student Visa Resources</Link></li>
              <li><Link href="/safety" className="hover:text-slate-900 transition-colors">Safety Guide</Link></li>
            </ul>
          </div>

          {/* Column 5: Providers */}
          <div className="lg:col-span-2">
            <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-widest mb-6">Providers</h4>
            <ul className="flex flex-col gap-4 text-sm text-slate-500 font-medium">
              <li><Link href="/list" className="hover:text-slate-900 transition-colors">List Your Property</Link></li>
              <li><Link href="/portal" className="hover:text-slate-900 transition-colors">Provider Portal</Link></li>
              <li><Link href="/verification" className="hover:text-slate-900 transition-colors">Verification Process</Link></li>
              <li><Link href="/pricing" className="hover:text-slate-900 transition-colors">Pricing</Link></li>
              <li><Link href="/support" className="hover:text-slate-900 transition-colors">Support</Link></li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar: Legal & Metadata */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-8 border-t border-slate-200/60">
          <p className="text-xs text-slate-400 font-medium">
            &copy; {new Date().getFullYear()} Jesmond Platform. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-6 text-xs text-slate-400 font-medium">
            <Link href="/privacy" className="hover:text-slate-900 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-slate-900 transition-colors">Terms of Service</Link>
            <Link href="/cookies" className="hover:text-slate-900 transition-colors">Cookies</Link>
            <Link href="/accessibility" className="hover:text-slate-900 transition-colors">Accessibility</Link>
            <Link href="/contact" className="hover:text-slate-900 transition-colors">Contact</Link>
          </div>
        </div>
        
      </div>
    </footer>
  );
}
