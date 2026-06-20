'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** PIXI Application 实例（CDN 加载，无类型包） */
interface PixiAppInstance {
	stage: { addChild: (child: unknown) => void; removeChild: (child: unknown) => void }
	view: HTMLCanvasElement
	destroy: (opts?: { removeView?: boolean }) => void
}

/** Live2D 模型实例 */
interface Live2DModelInstance {
	anchor: { set: (x: number, y: number) => void }
	x: number
	y: number
	scale: { set: (x: number, y: number) => void }
	internalModel?: {
		coreModel: {
			setParameterValueById: (id: string, value: number, weight?: number) => void
		}
	}
}

interface ModelOption {
	label: string
	url: string
	/** 用于去除水印的表情文件路径 */
	watermarkExpression?: string
	/** 加载后需要归零的嘴巴参数（闭合嘴巴） */
	mouthParams?: string[]
}

interface ExpressionItem {
	name: string
	file: string
	emoji: string
}

const MODELS: ModelOption[] = [
	{ label: '默认模型', url: '/live2d/live2d.model3.json' },
	{
		label: '绯英',
		url: '/live2d-feiying/feiying_q2_15.model3.json',
		watermarkExpression: '/live2d-feiying/expression13.exp3.json',
		mouthParams: ['ParamMouthOpenY', 'ParamMouthForm']
	}
]

/** 绯英模型的可用表情列表 */
const FEIYING_EXPRESSIONS: ExpressionItem[] = [
	{ name: '去狐耳', file: '/live2d-feiying/expression1.exp3.json', emoji: '🦊' },
	{ name: '新狐耳', file: '/live2d-feiying/expression2.exp3.json', emoji: '🐱' },
	{ name: '脸红', file: '/live2d-feiying/expression3.exp3.json', emoji: '😳' },
	{ name: '星星眼', file: '/live2d-feiying/expression4.exp3.json', emoji: '✨' },
	{ name: '撒娇', file: '/live2d-feiying/expression5.exp3.json', emoji: '🥺' },
	{ name: '爱心眼', file: '/live2d-feiying/expression6.exp3.json', emoji: '😍' },
	{ name: '生气', file: '/live2d-feiying/expression7.exp3.json', emoji: '😤' },
	{ name: '无语', file: '/live2d-feiying/expression8.exp3.json', emoji: '😑' },
	{ name: '叼面包', file: '/live2d-feiying/expression9.exp3.json', emoji: '🍞' },
	{ name: '智慧', file: '/live2d-feiying/expression10.exp3.json', emoji: '🧠' },
	{ name: '狐尾', file: '/live2d-feiying/expression12.exp3.json', emoji: '🪶' },
	{ name: '哭哭', file: '/live2d-feiying/cry.exp3.json', emoji: '😭' }
]

const CDN_SCRIPTS = [
	'https://cdnjs.cloudflare.com/ajax/libs/pixi.js/6.2.0/browser/pixi.min.js',
	'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
	'https://cdn.jsdelivr.net/npm/pixi-live2d-display/dist/cubism4.min.js'
]

function loadScript(src: string): Promise<void> {
	return new Promise((resolve, reject) => {
		if (document.querySelector(`script[src="${src}"]`)) {
			resolve()
			return
		}
		const script = document.createElement('script')
		script.src = src
		script.crossOrigin = 'anonymous'
		script.onload = () => resolve()
		script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
		document.head.appendChild(script)
	})
}

/** 加载并应用表情，用来修改模型参数 */
async function applyExpression(model: Live2DModelInstance, expressionUrl: string) {
	const res = await fetch(expressionUrl)
	const expData = await res.json() as { Parameters: { Id: string; Value: number; Blend: string }[] }
	const coreModel = model.internalModel?.coreModel
	if (!coreModel) return
	for (const param of expData.Parameters) {
		coreModel.setParameterValueById(param.Id, param.Value)
	}
}

/** 强制闭合嘴巴 */
function closeMouth(model: Live2DModelInstance, mouthParams: string[]) {
	const coreModel = model.internalModel?.coreModel
	if (!coreModel) return
	for (const id of mouthParams) {
		coreModel.setParameterValueById(id, 0)
	}
}

export default function Live2DViewer() {
	const containerRef = useRef<HTMLDivElement>(null)
	const modelRef = useRef<Live2DModelInstance | null>(null)
	const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
	const [errorMsg, setErrorMsg] = useState<string>('')
	const [currentModelIndex, setCurrentModelIndex] = useState(0)
	const [activeExpression, setActiveExpression] = useState<string | null>(null)
	const [renderTrigger, setRenderTrigger] = useState(0)

	const switchModel = useCallback((index: number) => {
		setCurrentModelIndex(index)
		setActiveExpression(null)
		setStatus('loading')
		setErrorMsg('')
	}, [])

	const handleExpression = useCallback(async (exp: ExpressionItem) => {
		const model = modelRef.current
		if (!model) return
		try {
			await applyExpression(model, exp.file)
			setActiveExpression(exp.name)
		} catch {
			// 应用失败不处理
		}
	}, [])

	const handleReset = useCallback(() => {
		setActiveExpression(null)
		setRenderTrigger(t => t + 1)
	}, [])

	useEffect(() => {
		const container = containerRef.current
		if (!container) return

		let app: PixiAppInstance | null = null
		let cancelled = false

		const init = async () => {
			try {
				for (const src of CDN_SCRIPTS) {
					await loadScript(src)
				}

				const PIXI = (window as unknown as { PIXI: unknown }).PIXI
				if (!PIXI) {
					throw new Error('PIXI not found on window')
				}
				;(window as unknown as { PIXI: unknown }).PIXI = PIXI

				const PIXIApp = (
					PIXI as { Application: new (opts: { view: HTMLCanvasElement; width?: number; height?: number; backgroundAlpha?: number }) => PixiAppInstance }
				).Application

				const Live2DModel = (PIXI as { live2d?: { Live2DModel: { from: (url: string) => Promise<Live2DModelInstance> } } }).live2d?.Live2DModel

				if (!Live2DModel) {
					throw new Error('PIXI.live2d.Live2DModel not found')
				}

				const width = container.clientWidth || 500
				const height = container.clientHeight || 500
				const canvas = document.createElement('canvas')
				canvas.style.width = '100%'
				canvas.style.height = '100%'
				canvas.style.display = 'block'
				container.appendChild(canvas)

				app = new PIXIApp({
					view: canvas,
					width,
					height,
					backgroundAlpha: 0
				})

				if (cancelled) return

				const modelOption = MODELS[currentModelIndex]
				const model = await Live2DModel.from(modelOption.url)
				modelRef.current = model
				app.stage.addChild(model)

				model.anchor.set(0.5, 0.5)
				model.x = width / 2
				model.y = height / 2
				model.scale.set(0.25, 0.25)

				// 自动去除绯英模型的水印
				if (modelOption.watermarkExpression) {
					await applyExpression(model, modelOption.watermarkExpression)
				}

				// 强制闭合嘴巴（网页播放器缺少面部追踪，嘴巴默认可能张开）
				if (modelOption.mouthParams) {
					closeMouth(model, modelOption.mouthParams)
				}

				if (!cancelled) {
					setStatus('ready')
				}
			} catch (err) {
				if (!cancelled) {
					setErrorMsg(err instanceof Error ? err.message : String(err))
					setStatus('error')
				}
			}
		}

		init()

		return () => {
			cancelled = true
			modelRef.current = null
			if (app !== null && typeof app === 'object' && 'destroy' in app && typeof app.destroy === 'function') {
				app.destroy({ removeView: true })
			}
			container.innerHTML = ''
		}
	}, [currentModelIndex, renderTrigger])

	const showExpressionPanel = currentModelIndex === 1

	return (
		<div className='flex w-full max-w-lg flex-col items-center gap-4'>
			{/* 模型切换器 */}
			<div className='flex gap-2'>
				{MODELS.map((m, i) => (
					<button
						key={m.label}
						onClick={() => switchModel(i)}
						className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
							i === currentModelIndex
								? 'bg-pink-400 text-white shadow-md'
								: 'bg-white/60 text-gray-600 hover:bg-white/80'
						}`}
					>
						{m.label}
					</button>
				))}
			</div>

			{/* 模型显示区域 */}
			<div className='relative aspect-square w-full overflow-hidden rounded-full'>
				<div ref={containerRef} className='absolute inset-0 h-full w-full' />
				{status === 'loading' && (
					<div className='absolute inset-0 flex items-center justify-center text-secondary'>加载 Live2D 模型中…</div>
				)}
				{status === 'error' && (
					<div className='absolute inset-0 flex items-center justify-center p-4 text-center text-red-500'>{errorMsg}</div>
				)}
			</div>

			{/* 表情切换面板（仅绯英模型显示） */}
			{showExpressionPanel && (
				<div className='flex flex-col items-center gap-2'>
					{/* 重置按钮 */}
					<div className='flex items-center gap-2'>
						<span className='text-xs text-gray-500'>
							{activeExpression ? `当前表情：${activeExpression}` : '默认表情'}
						</span>
						<button
							onClick={handleReset}
							className='rounded-full bg-white/60 px-3 py-1 text-xs text-gray-600 transition-colors hover:bg-white/80'
						>
							重置
						</button>
					</div>

					{/* 表情按钮网格 */}
					<div className='grid w-full grid-cols-4 gap-1.5 sm:grid-cols-7'>
						{FEIYING_EXPRESSIONS.map(exp => {
							const isActive = activeExpression === exp.name
							return (
								<button
									key={exp.name}
									onClick={() => handleExpression(exp)}
									title={exp.name}
									className={`flex flex-col items-center justify-center rounded-xl px-1.5 py-2 text-xs font-medium transition-all ${
										isActive
											? 'bg-pink-400 text-white shadow-sm scale-105'
											: 'bg-white/60 text-gray-600 hover:bg-white/80 hover:scale-105'
									}`}
								>
									<span className='text-lg leading-none'>{exp.emoji}</span>
									<span className='mt-0.5 text-[10px]'>{exp.name}</span>
								</button>
							)
						})}
					</div>
				</div>
			)}
		</div>
	)
}
