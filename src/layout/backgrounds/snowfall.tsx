'use client'
import { useEffect, useState } from 'react'
import { motion } from 'motion/react'

interface Petal {
	id: number
	size: number
	duration: number
	delay: number
	left: number
	rotate: number
	opacity: number
	wobble: number
}

export default function SnowfallBackground({ zIndex, count = 80 }: { zIndex: number; count?: number }) {
	const [petals, setPetals] = useState<Petal[]>([])

	useEffect(() => {
		const generatePetals = () => {
			const newPetals: Petal[] = []
			for (let i = 0; i < count; i++) {
				const size = Math.random() * 20 + 15
				const duration = Math.random() * 15 + 15
				const delay = Math.random() * 30
				const left = Math.random() * 120
				const rotate = Math.random() * 360
				const opacity = Math.random() * 0.5 + 0.4
				const wobble = Math.random() * 20 + 10

				newPetals.push({
					id: i,
					size,
					duration,
					delay,
					left,
					rotate,
					opacity,
					wobble
				})
			}
			setPetals(newPetals)
		}

		generatePetals()
	}, [count])

	return (
		<motion.div
			animate={{ opacity: 1 }}
			initial={{ opacity: 0 }}
			transition={{ duration: 1 }}
			className='pointer-events-none fixed inset-0 z-0 overflow-hidden'
			style={{ zIndex }}>
			{petals.map(petal => (
				<motion.div
					key={petal.id}
					className='absolute'
					style={{
						top: -100,
						left: `${petal.left}%`,
						width: `${petal.size}px`,
						height: `${petal.size}px`,
						opacity: petal.opacity
					}}
					initial={{ y: 0, x: 0, rotate: 0 }}
					animate={{
						y: window.innerHeight + 100,
						x: [0, `${petal.wobble}px`, `-${petal.wobble}px`, `${petal.wobble / 2}px`, 0],
						rotate: petal.rotate
					}}
					transition={{
						duration: petal.duration,
						delay: petal.delay,
						repeat: Infinity,
						ease: 'linear',
						x: {
							duration: petal.duration / 3,
							repeat: Infinity,
							ease: 'easeInOut'
						}
					}}>
					<div
						className='h-full w-full'
						style={{
							background: 'linear-gradient(135deg, #ffc8d4 0%, #ff9fb3 50%, #ffb7c5 100%)',
							borderRadius: '50% 0 50% 50%',
							transform: 'rotate(-45deg)',
							boxShadow: '0 2px 8px rgba(255, 159, 179, 0.5)'
						}}
					/>
				</motion.div>
			))}
		</motion.div>
	)
}
