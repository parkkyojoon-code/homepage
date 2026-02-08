"use client"

import { motion } from "framer-motion"

interface CategoryFilterProps {
  categories: string[]
  selectedCategory: string
  onCategoryChange: (category: string) => void
}

export default function CategoryFilter({
  categories,
  selectedCategory,
  onCategoryChange
}: CategoryFilterProps) {
  return (
    <div style={{
      display: 'flex',
      gap: '0.75rem',
      flexWrap: 'wrap'
    }}>
      {categories.map((category) => (
        <motion.button
          key={category}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onCategoryChange(category)}
          style={{
            padding: '0.75rem 1.5rem',
            background: selectedCategory === category
              ? 'linear-gradient(90deg, #0066FF, #0099FF)'
              : 'rgba(255, 255, 255, 0.05)',
            border: selectedCategory === category
              ? 'none'
              : '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '100px',
            color: selectedCategory === category
              ? '#FFFFFF'
              : '#808080',
            fontSize: '0.9375rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.3s',
            letterSpacing: '-0.01em'
          }}
          onMouseEnter={(e) => {
            if (selectedCategory !== category) {
              e.currentTarget.style.borderColor = 'rgba(0, 102, 255, 0.3)'
              e.currentTarget.style.color = '#FFFFFF'
            }
          }}
          onMouseLeave={(e) => {
            if (selectedCategory !== category) {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
              e.currentTarget.style.color = '#808080'
            }
          }}
        >
          {category}
        </motion.button>
      ))}
    </div>
  )
}