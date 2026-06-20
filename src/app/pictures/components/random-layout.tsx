'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useMotionValue } from 'motion/react'
import { useCenterInit, useCenterStore } from '@/hooks/use-center'
import { Picture } from '../page'
import siteContent from '@/config/site-content.json'
import { cn } from '@/lib/utils'
import { useSize } from '@/hooks/use-size'

interface RandomLayoutProps {
	pictures: Picture[]
	isEditMode?: boolean
	onDeleteSingle?: (pictureId: string, imageIndex: number | 'single') => void
	onDeleteGroup?: (picture: Picture) => void
}

type PositionedItem = {
	x: number
	y: number
	rotation: number
}

type OriginalSize = {
	width: number
	height: number
}

interface FloatingImageProps {
	url: string
	index: number
	groupIndex: number
	position: PositionedItem
	description?: string
	uploadedAt?: string
	pictureId: string
	imageIndex: number | 'single'
	isEditMode?: boolean
	onDeleteSingle?: (pictureId: string, imageIndex: number | 'single') => void
	onDeleteGroup?: () => void
}

type UrlItem = {
	url: string
	groupIndex: number
	description?: string
	uploadedAt?: string
	pictureId: string
	imageIndex: number | 'single'
}

const buildUrlList = (pictures: Picture[]): UrlItem[] => {
	const result: UrlItem[] = []

	for (const [index, picture] of pictures.entries()) {
		if (picture.image) {
			result.push({
				url: picture.image,
				groupIndex: index,
				description: picture.description,
				uploadedAt: picture.uploadedAt,
				pictureId: picture.id,
				imageIndex: 'single'
			})
		}

		if (picture.images && picture.images.length > 0) {
			result.push(
				...picture.images.map((url, imageIndex) => ({
					url,
					groupIndex: index,
					description: picture.description,
					uploadedAt: picture.uploadedAt,
					pictureId: picture.id,
					imageIndex: imageIndex
				}))
			)
		}
	}

	return result
}

let lastZIndex = 10
const TOP_Z_INDEX = 9999

const formatUploadedAt = (uploadedAt?: string) => {
	if (!uploadedAt) return ''
	const date = new Date(uploadedAt)
	if (Number.isNaN(date.getTime())) return uploadedAt

	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	const hours = String(date.getHours()).padStart(2, '0')
	const minutes = String(date.getMinutes()).padStart(2, '0')

	return `${year}-${month}-${day} ${hours}:${minutes}`
}

const loadSavedOffset = (url: string): { x: number; y: number } => {
	try {
		const saved = localStorage.getItem(`picture-offset-${url}`)
		if (saved) {
			const parsed = JSON.parse(saved)
			return { x: parsed.x || 0, y: parsed.y || 0 }
		}
	} catch (error) {
		console.error('Failed to load saved offset:', error)
	}
	return { x: 0, y: 0 }
}

const saveOffset = (url: string, offset: { x: number; y: number }) => {
	try {
		localStorage.setItem(`picture-offset-${url}`, JSON.stringify(offset))
	} catch (error) {
		console.error('Failed to save offset:', error)
	}
}

const FloatingImage = ({
	url,
	index,
	groupIndex,
	position,
	description,
	uploadedAt,
	pictureId,
	imageIndex,
	isEditMode,
	onDeleteSingle,
	onDeleteGroup
}: FloatingImageProps) => {
	const { centerX, centerY } = useCenterStore()
	const { maxSM, init } = useSize()
	const bodyRef = useRef(document.body)
	const mouseDownTimeRef = useRef<number | null>(null)
	const hasDraggedRef = useRef(false)
	const [zIndex, setZIndex] = useState(index)
	const [show, setShow] = useState(false)
	const initialOffset = useMemo(() => loadSavedOffset(url), [url])
	const x = useMotionValue(initialOffset.x)
	const y = useMotionValue(initialOffset.y)

	useEffect(() => {
		setTimeout(() => {
			setShow(true)
		}, 200 * index)
	}, [])

	const [originalSize, setOriginalSize] = useState<OriginalSize | null>(null)

	const displaySize = useMemo(() => {
		if (!originalSize) {
			return { width: 200, height: 200 }
		}

		const ratio = originalSize.width / originalSize.height
		const minRatio = 2 / 3
		const maxRatio = 3 / 2
		const clampedRatio = Math.min(Math.max(ratio, minRatio), maxRatio)

		const baseWidth = 300

		return {
			width: baseWidth,
			height: baseWidth / clampedRatio
		}
	}, [originalSize])

	const zoomedSize = useMemo(() => {
		if (!originalSize) {
			return { width: 200, height: 200 }
		}

		if (typeof window === 'undefined') {
			return originalSize
		}

		const padding = 24
		const maxWidth = document.documentElement.clientWidth - padding * 2
		const maxHeight = document.documentElement.clientHeight - padding * 2

		const scale = Math.min(maxWidth / originalSize.width, maxHeight / originalSize.height, 1)

		return {
			width: originalSize.width * scale,
			height: originalSize.height * scale
		}
	}, [originalSize])

	const [isZoomed, setIsZoomed] = useState(false)

	if (!position || !show) return null

	const thumbnailLeft = centerX + position.x - displaySize.width / 2
	const thumbnailTop = centerY + position.y - displaySize.height / 2
	const layoutId = url

	return (
		<>
			{/* ========== 缩略图（未放大） ========== */}
			<AnimatePresence>
				{!isZoomed && (
					<motion.div
						key='thumb'
						layoutId={layoutId}
						drag
						dragConstraints={bodyRef}
						dragMomentum={false}
						dragElastic={0}
						onMouseDown={() => {
							lastZIndex = lastZIndex + 1
							setZIndex(lastZIndex)
							mouseDownTimeRef.current = Date.now()
							hasDraggedRef.current = false
						}}
						onMouseUp={event => {
							// 只有没有发生拖拽 + 短按才算点击打开
							if (!hasDraggedRef.current && mouseDownTimeRef.current !== null) {
								const duration = Date.now() - mouseDownTimeRef.current
								if (duration <= 300) {
									setIsZoomed(true)
								}
							}
							mouseDownTimeRef.current = null
						}}
						onDragEnd={() => {
							hasDraggedRef.current = true
							saveOffset(url, { x: x.get(), y: y.get() })
						}}
						exit={{ opacity: 0 }}
						style={{
							position: 'absolute',
							left: thumbnailLeft,
							top: thumbnailTop,
							x,
							y,
							width: displaySize.width,
							height: displaySize.height,
							rotate: position.rotation,
							zIndex,
						}}
						className={cn(
							'cursor-pointer shadow-xl origin-center',
							!isEditMode && 'hover:scale-105'
						)}>
						<motion.img
							src={url}
							onLoad={event => {
								const img = event.currentTarget
								setOriginalSize({ width: img.naturalWidth, height: img.naturalHeight })
							}}
							draggable={false}
							className='h-full w-full rounded-2xl border-[8px] border-white/80 object-cover select-none shadow-lg'
						/>
						{isEditMode && (
							<motion.button
								initial={{ opacity: 0, scale: 0.8 }}
								animate={{ opacity: 1, scale: 1 }}
								onClick={e => {
									e.stopPropagation()
									onDeleteSingle?.(pictureId, imageIndex)
								}}
								onMouseUp={e => {
									e.stopPropagation()
								}}
								className='absolute -top-2 -right-2 rounded-full bg-red-500 p-1.5 shadow-lg hover:scale-105 hover:bg-red-600'
								style={{ zIndex: 1 }}>
								<svg xmlns='http://www.w3.org/2000/svg' className='h-3 w-3 text-white' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
									<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
								</svg>
							</motion.button>
						)}
					</motion.div>
				)}
			</AnimatePresence>

			{/* ========== 放大弹窗 ========== */}
			<AnimatePresence>
				{isZoomed && (
					<>
						{/* 背景遮罩 */}
						<motion.div
							key='backdrop'
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							onClick={() => setIsZoomed(false)}
							className='bg-card fixed inset-0 z-50 backdrop-blur-xl'
						/>

						{/* 居中容器 + 大图 */}
						<div key='zoomed-wrap' className='pointer-events-none fixed inset-0 z-50 flex items-center justify-center'>
							<motion.div
								key='zoomed'
								layoutId={layoutId}
								exit={{ opacity: 0 }}
								onClick={maxSM ? () => setIsZoomed(false) : undefined}
								className='pointer-events-auto cursor-pointer'
								style={{
									width: zoomedSize.width,
									height: zoomedSize.height,
								}}>
								<motion.img
									src={url}
									draggable={false}
									className={cn(
										'h-full w-full rounded-2xl object-cover select-none shadow-2xl',
										maxSM ? 'border-[12px] border-white/80' : 'border-[24px] border-white/80'
									)}
								/>
							</motion.div>
						</div>

						{/* 描述卡片 */}
						{description && (
							<motion.div
								key='desc'
								drag
								dragConstraints={maxSM ? undefined : bodyRef}
								dragMomentum={false}
								initial={{ opacity: 0, scale: 0.4 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.4 }}
								className='fixed min-h-[150px] w-[200px] cursor-pointer rounded-2xl p-6 shadow-lg'
								style={{
									backgroundColor: siteContent.backgroundColors[groupIndex % siteContent.backgroundColors.length],
									zIndex: 10000,
									right: maxSM ? 12 : centerX / 3,
									top: maxSM ? 12 : centerY,
								}}>
								<div className='text-secondary mb-2 text-xs'>{formatUploadedAt(uploadedAt)}</div>
								<div className='text-sm'>{description}</div>
							</motion.div>
						)}
					</>
				)}
			</AnimatePresence>
		</>
	)
}

// 基于唯一标识生成稳定的位置
// 使用 ref 存储稳定的位置映射
const positionCacheRef = new Map<string, PositionedItem>()
const getStablePosition = (uniqueId: string, width: number, height: number): PositionedItem => {
	// 如果已有缓存，直接返回
	if (positionCacheRef.has(uniqueId)) {
		return positionCacheRef.get(uniqueId)!
	}

	// 使用 uniqueId 的哈希值来生成稳定的索引
	let hash = 0
	for (let i = 0; i < uniqueId.length; i++) {
		const char = uniqueId.charCodeAt(i)
		hash = (hash << 5) - hash + char
		hash = hash & hash // Convert to 32bit integer
	}
	const stableIndex = Math.abs(hash) % 10000

	const maxRadius = Math.min(width, height) / 2 - 100
	const goldenAngle = Math.PI * (3 - Math.sqrt(5))

	// 使用稳定索引来计算位置，而不是数组索引
	const t = (stableIndex % 1000) / 1000
	const radius = Math.pow(t, 0.8) * maxRadius
	const angle = stableIndex * goldenAngle

	const baseX = radius * Math.cos(angle)
	const baseY = radius * Math.sin(angle)

	// 使用 uniqueId 生成稳定的 jitter，确保每次都是相同的位置
	const jitterSeed = Math.abs(hash) % 1000
	const jitterRadius = 12
	const jitterX = (jitterSeed % (jitterRadius * 2)) - jitterRadius
	const jitterY = ((jitterSeed * 7) % (jitterRadius * 2)) - jitterRadius

	const rotation = ((jitterSeed * 13) % 60) - 30

	const position = {
		x: baseX + jitterX,
		y: baseY + jitterY,
		rotation
	}

	positionCacheRef.set(uniqueId, position)
	return position
}

export const RandomLayout = ({ pictures, isEditMode = false, onDeleteSingle, onDeleteGroup }: RandomLayoutProps) => {
	useCenterInit()
	const { width, height } = useCenterStore()
	const [show, setShow] = useState(false)

	useEffect(() => {
		setTimeout(() => {
			setShow(true)
		}, 1000)
	}, [])

	const urls = useMemo(() => buildUrlList(pictures), [pictures])

	const pictureMap = useMemo(() => {
		const map = new Map<string, Picture>()
		pictures.forEach(picture => {
			map.set(picture.id, picture)
		})
		return map
	}, [pictures])

	const positionedItems = useMemo(() => {
		return urls.map((item, index) => {
			const picture = pictureMap.get(item.pictureId)
			const position = getStablePosition(item.url, width, height)
			return { item, index, picture, position }
		})
	}, [urls, pictureMap, width, height])

	if (!urls.length || !width || !height) {
		return null
	}

	if (!show) return null

	lastZIndex = urls.length + 11

	return (
		<>
			{positionedItems.map(({ item, index, picture, position }) => (
				<FloatingImage
					key={item.url}
					url={item.url}
					index={index}
					groupIndex={item.groupIndex}
					position={position}
					description={item.description}
					uploadedAt={item.uploadedAt}
					pictureId={item.pictureId}
					imageIndex={item.imageIndex}
					isEditMode={isEditMode}
					onDeleteSingle={onDeleteSingle}
					onDeleteGroup={picture ? () => onDeleteGroup?.(picture) : undefined}
				/>
			))}
		</>
	)
}
