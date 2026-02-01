"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

interface Slide {
  id: string;
  title: string;
  description: string;
  image: string;
  link: string;
  cta: string;
}

const slides: Slide[] = [
  {
    id: "1",
    title: "WHERE DRAG COMES TO PLAY",
    description: "A global community for drag creators and fans to connect, share, and thrive.",
    image: "/Famers/DRAGVERSE_HALL_OF_FAME.png",
    link: "/videos",
    cta: "Explore Now",
  },
  {
    id: "2",
    title: "LIFE IS SALTY AFTER ALL",
    description: "Meet saltï and her experiments",
    image: "/Famers/SALT.jpg",
    link: "/profile",
    cta: "View Profile",
  },
];

export function HeroSlider() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (isHovered) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000); // 5 seconds per slide

    return () => clearInterval(interval);
  }, [isHovered]);

  const goToPrevious = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goToNext = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  return (
    <div
      className="relative w-full h-full rounded-[24px] overflow-hidden group shadow-2xl border-2 border-white/10"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Slides */}
      <div className="relative w-full h-full">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-700 ${
              index === currentSlide ? "opacity-100 z-10" : "opacity-0 z-0"
            }`}
          >
            {/* Background Image */}
            <Image
              src={slide.image}
              alt={slide.title}
              fill
              className={`object-cover ${slide.id === "1" ? "object-bottom" : ""}`}
              priority={index === 0}
            />

            {/* Multi-layer Gradient Overlay for better contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" />

            {/* Content */}
            <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-12 text-white z-20">
              <div className="max-w-2xl">
                <h2 className="font-heading text-2xl md:text-3xl font-black uppercase mb-4 md:mb-5 drop-shadow-2xl tracking-tight leading-none">
                  {slide.title}
                </h2>
                <p className="text-base md:text-lg text-gray-200 mb-6 md:mb-8 max-w-lg drop-shadow-lg leading-relaxed">
                  {slide.description}
                </p>
                <Link
                  href={slide.link}
                  {...(slide.link.startsWith('http') ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="inline-flex items-center gap-4 group/link"
                >
                  <span className="text-base font-black uppercase tracking-wider hover:text-[#EB83EA] transition-colors">
                    {slide.cta}
                  </span>
                  <svg
                    className="w-8 h-8 text-white group-hover/link:text-[#EB83EA] group-hover/link:translate-x-2 transition-all"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={goToPrevious}
        className="absolute left-6 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-black/50 backdrop-blur-md hover:bg-black/70 text-white transition-all opacity-0 group-hover:opacity-100 border border-white/30"
        aria-label="Previous slide"
      >
        <FiChevronLeft className="w-6 h-6" />
      </button>
      <button
        onClick={goToNext}
        className="absolute right-6 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-black/50 backdrop-blur-md hover:bg-black/70 text-white transition-all opacity-0 group-hover:opacity-100 border border-white/30"
        aria-label="Next slide"
      >
        <FiChevronRight className="w-6 h-6" />
      </button>

    </div>
  );
}
