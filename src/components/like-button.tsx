import { useCallback, useEffect, useState } from 'react'
import useSWR from 'swr'
import { motion, AnimatePresence } from 'motion/react'
import { Heart } from 'lucide-react'
import clsx from 'clsx'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { BLOG_SLUG_KEY } from '@/consts'

type LikeButtonProps = {
	slug?: string
	className?: string
	delay?: number
}

const ENDPOINT = process.env.NEXT_PUBLIC_LIKE_API_URL || 'http://localhost:8787'

export default function LikeButton({ slug = 'yysuni', delay, className }: LikeButtonProps) {
	slug = BLOG_SLUG_KEY + slug
	const [liked, setLiked] = useState(false)
	const [show, setShow] = useState(false)
	const [justLiked, setJustLiked] = useState(false)
	const [localLikes, setLocalLikes] = useState(0)
	const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number }>>([])
	const [floatTexts, setFloatTexts] = useState<Array<{ id: number; text: string }>>([])

	const FLOAT_TEXTS = ['+5 笑点', '好活当赏！', '欢愉伤害！']

	useEffect(() => {
		setTimeout(() => {
			setShow(true)
		}, delay || 1000)
	}, [])

	useEffect(() => {
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem(`like_count_${slug}`)
			if (saved) {
				const val = parseInt(saved, 10) || 0
				setLocalLikes(val)
				if (val >= 1) {
					setLiked(true)
				}
			}
		}
	}, [slug])

	useEffect(() => {
		if (justLiked) {
			const timer = setTimeout(() => setJustLiked(false), 600)
			return () => clearTimeout(timer)
		}
	}, [justLiked])

	const fetcher = useCallback(async (url: string): Promise<number | null> => {
		const res = await fetch(url, { method: 'GET', cache: 'no-store' })
		if (!res.ok) return null
		const data = await res.json().catch(() => ({}))
		return typeof data?.likes === 'number' ? data.likes : null
	}, [])

	const { data: fetchedCount, mutate } = useSWR(slug ? `${ENDPOINT}/like?id=${encodeURIComponent(slug)}` : null, fetcher, {
		revalidateOnFocus: false,
		dedupingInterval: 1000 * 10
	})

	const handleLike = useCallback(async () => {
		if (!slug) return
		if (localLikes >= 5) {
			toast('已经点很多次了，再点阿哈要笑死了')
			return
		}

		const newLocalLikes = localLikes + 1
		setLocalLikes(newLocalLikes)
		localStorage.setItem(`like_count_${slug}`, newLocalLikes.toString())

		setLiked(true)
		setJustLiked(true)

		const newParticles = Array.from({ length: 6 }, (_, i) => ({
			id: Date.now() + i,
			x: Math.random() * 60 - 30,
			y: Math.random() * 60 - 30
		}))
		setParticles(newParticles)

		setTimeout(() => setParticles([]), 1000)

		const randomText = FLOAT_TEXTS[Math.floor(Math.random() * FLOAT_TEXTS.length)]
		setFloatTexts(prev => [...prev, { id: Date.now(), text: randomText }])
		setTimeout(() => setFloatTexts(prev => prev.filter(t => t.id !== Date.now())), 1200)

		try {
			const url = `${ENDPOINT}/like?id=${encodeURIComponent(slug)}`
			const res = await fetch(url, { method: 'POST' })
			const data = await res.json().catch(() => ({}))
			const value = typeof data?.likes === 'number' ? data.likes : (fetchedCount ?? 0) + 1
			await mutate(value, { revalidate: false })
		} catch {
		}
	}, [slug, fetchedCount, mutate, localLikes])

	const count = typeof fetchedCount === 'number' ? fetchedCount : null

	if (show)
		return (
			<motion.button
				initial={{ opacity: 0, scale: 0.6 }}
				animate={{ opacity: 1, scale: 1 }}
				whileHover={{ scale: 1.05 }}
				whileTap={{ scale: 0.95 }}
				aria-label='Like this post'
				onClick={handleLike}
				className={clsx('card heartbeat-container relative overflow-visible rounded-full p-3', className)}>
				<AnimatePresence>
					{particles.map(particle => (
						<motion.div
							key={particle.id}
							className='pointer-events-none absolute inset-0 flex items-center justify-center'
							initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
							animate={{
								opacity: [1, 1, 0],
								scale: [0, 1.2, 0.8],
								x: particle.x,
								y: particle.y
							}}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.8, ease: 'easeOut' }}>
							<Heart className='fill-rose-400 text-rose-400' size={12} />
						</motion.div>
					))}
				</AnimatePresence>

				<AnimatePresence>
					{floatTexts.map(ft => (
						<motion.div
							key={ft.id}
							className='pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap font-bold text-rose-400 drop-shadow-sm'
							initial={{ opacity: 1, y: 0 }}
							animate={{ opacity: 0, y: -48 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 1, ease: 'easeOut' }}>
							{ft.text}
						</motion.div>
					))}
				</AnimatePresence>

				{typeof count === 'number' && (
					<motion.span
						initial={{ scale: 0.4 }}
						animate={{ scale: 1 }}
						className={cn(
							'absolute -top-2 left-9 min-w-6 rounded-full px-1.5 py-1 text-center text-xs text-white tabular-nums',
							liked ? 'bg-rose-400' : 'bg-gray-300'
						)}>
						{count}
					</motion.span>
				)}
				<motion.div animate={justLiked ? { scale: [1, 1.4, 1], rotate: [0, -10, 10, 0] } : {}} transition={{ duration: 0.6, ease: 'easeOut' }}>
					<Heart className={clsx('heartbeat', liked ? 'fill-rose-400 text-rose-400' : 'fill-rose-200 text-rose-200')} size={28} />
				</motion.div>
			</motion.button>
		)
}
