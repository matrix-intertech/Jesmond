import Image from "next/image";
import Link from "next/link";

const PROPERTIES = [
  {
    id: "prop-1",
    name: "Scape Swanston",
    provider: "Scape",
    verified: true,
    rating: 4.9,
    university: "RMIT University",
    distance: "2 min walk",
    rent: "$389",
    availability: "Available Now",
    roomType: "Private Studio",
    amenities: ["Gym", "Cinema", "Study Hub", "24/7 Security"],
    image: "/assets/prop_1.png",
  },
  {
    id: "prop-2",
    name: "Iglu Redfern",
    provider: "Iglu",
    verified: true,
    rating: 4.8,
    university: "University of Sydney",
    distance: "10 min walk",
    rent: "$420",
    availability: "Semester 1 (Feb)",
    roomType: "Premium En-suite",
    amenities: ["Rooftop BBQ", "Cafe", "Fitness Center"],
    image: "/assets/prop_2.png",
  }
];

export function PropertyDiscovery() {
  return (
    <section className="w-full max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16 py-24 bg-slate-50">
      
      {/* Elegant Section Heading */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
        <div className="max-w-2xl">
          <h2 
            className="text-[2.5rem] lg:text-[3.5rem] font-medium text-slate-900 tracking-[-0.03em] leading-[1.1] mb-6"
            style={{ fontFamily: 'var(--font-outfit)' }}
          >
            Curated living spaces.
          </h2>
          <p className="text-lg text-slate-500 font-light">
            We don't list everything. We only list the best. 
            Discover verified properties designed specifically for student success.
          </p>
        </div>
        
        {/* Quick Discovery Tabs */}
        <div className="flex gap-2 p-1 bg-slate-200/50 rounded-full border border-slate-200">
          <button className="px-6 py-2.5 bg-white text-slate-900 rounded-full text-sm font-semibold shadow-sm">
            Top Rated
          </button>
          <button className="px-6 py-2.5 text-slate-500 hover:text-slate-900 rounded-full text-sm font-medium transition-colors">
            Closest to Campus
          </button>
          <button className="px-6 py-2.5 text-slate-500 hover:text-slate-900 rounded-full text-sm font-medium transition-colors">
            Available Now
          </button>
        </div>
      </div>

      {/* Property Grid Optimized for Student Conversion Psychology */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {PROPERTIES.map((property) => (
          <div key={property.id} className="group relative flex flex-col rounded-[24px] bg-white border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden hover:shadow-[0_20px_40px_rgb(0,0,0,0.12)] transition-all duration-500">
            
            {/* Massive Image Header */}
            <div className="relative w-full h-[360px] overflow-hidden bg-slate-100">
              <Image 
                src={property.image}
                alt={property.name}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />
              
              {/* Priority 5: Trust (Top Left) & Favourite (Top Right) */}
              <div className="absolute top-6 w-full px-6 flex justify-between items-start z-10">
                <div className="flex flex-col gap-2">
                  {property.verified && (
                    <div className="flex items-center gap-1.5 bg-emerald-500/90 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest shadow-sm">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      Verified
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-sm w-fit">
                    <svg className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                    {property.rating} Student Score
                  </div>
                </div>
                
                <button className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors shadow-sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                </button>
              </div>

              {/* Priority 7: Provider (Bottom Left - Lowest Priority) */}
              <div className="absolute bottom-6 left-6 z-10">
                <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest">Managed by {property.provider}</p>
              </div>
            </div>

            {/* Data Section Engineered for 5-second decision making */}
            <div className="p-6 lg:p-10 flex flex-col flex-grow justify-between bg-white relative">
              
              {/* Priority 1: Affordability & Identity */}
              <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-6">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">{property.name}</h3>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">From</p>
                  <p className="text-3xl font-bold text-indigo-600 tracking-tight leading-none">{property.rent}<span className="text-sm font-medium text-slate-500">/wk</span></p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-y-6 gap-x-6 mb-8">
                
                {/* Priority 2: Distance to University (Visual Highlight) */}
                <div className="col-span-2 bg-indigo-50 rounded-xl p-4 flex items-center gap-3 border border-indigo-100/50">
                  <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest mb-0.5">Distance</p>
                    <p className="text-sm font-semibold text-indigo-900">{property.distance} to <span className="font-bold">{property.university}</span></p>
                  </div>
                </div>

                {/* Priority 3: Availability */}
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Availability
                  </p>
                  <p className="text-sm font-bold text-emerald-600 bg-emerald-50 inline-flex items-center px-2.5 py-1 rounded-md border border-emerald-100">{property.availability}</p>
                </div>

                {/* Priority 4: Room Type */}
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                    Room Type
                  </p>
                  <p className="text-sm font-semibold text-slate-800">{property.roomType}</p>
                </div>

              </div>

              {/* Priority 6: Amenities (Lowest Priority Data) */}
              <div className="flex flex-wrap gap-2 mb-8">
                {property.amenities.slice(0, 3).map(amenity => (
                  <span key={amenity} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-md text-[11px] font-bold uppercase tracking-wider border border-slate-200/60">
                    {amenity}
                  </span>
                ))}
                {property.amenities.length > 3 && (
                  <span className="px-3 py-1.5 bg-slate-50 text-slate-400 rounded-md text-[11px] font-bold uppercase tracking-wider border border-slate-200/60">
                    +{property.amenities.length - 3} more
                  </span>
                )}
              </div>

              {/* Ultimate CTA */}
              <Link href={`/property/${property.id}`} className="w-full mt-auto">
                <button className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 group/btn">
                  View Property
                  <svg className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </button>
              </Link>
            </div>
            
          </div>
        ))}
      </div>
    </section>
  );
}
