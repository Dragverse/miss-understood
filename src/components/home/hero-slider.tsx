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
      className="relative w-full h-full rounded-[32px] overflow-hidden group shadow-2xl border-2 border-white/5"
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

            {/* Enhanced Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30" />

            {/* Content */}
            <div className="absolute bottom-0 left-0 right-0 p-8 md:p-10 text-white z-20">
              <h2 className="font-heading text-3xl md:text-4xl font-black uppercase mb-3 md:mb-4 drop-shadow-2xl tracking-wide leading-tight">
                {slide.title}
              </h2>
              <p className="text-sm md:text-base text-gray-100 mb-5 md:mb-6 max-w-md drop-shadow-lg leading-relaxed">
                {slide.description}
              </p>
              <Link
                href={slide.link}
                {...(slide.link.startsWith('http') ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="inline-flex items-center gap-2 px-6 py-3 md:px-8 md:py-4 bg-gradient-to-r from-[#EB83EA] via-[#D946EF] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6b2fd5] text-white text-sm md:text-base font-bold rounded-full transition-all shadow-xl hover:shadow-2xl hover:scale-105 transform"
              >
                {slide.cta}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={goToPrevious}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white transition-all opacity-0 group-hover:opacity-100 border border-white/20"
        aria-label="Previous slide"
      >
        <FiChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={goToNext}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white transition-all opacity-0 group-hover:opacity-100 border border-white/20"
        aria-label="Next slide"
      >
        <FiChevronRight className="w-5 h-5" />
      </button>

      {/* Slide Indicators */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex gap-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`h-1 rounded-full transition-all ${
              index === currentSlide
                ? "bg-white w-8 shadow-lg"
                : "bg-white/40 hover:bg-white/60 w-6"
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
