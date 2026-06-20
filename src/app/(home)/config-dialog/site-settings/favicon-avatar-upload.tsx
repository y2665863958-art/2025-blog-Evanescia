export function FaviconAvatarUpload() {
	return (
		<div className='grid grid-cols-2 gap-4'>
			<div>
				<label className='mb-2 block text-sm font-medium'>Favicon</label>
				<div className='relative h-20 w-20 overflow-hidden rounded-lg border bg-white/60'>
					<img src='/images/feiying/fying3.png' alt='current favicon' className='h-full w-full object-cover' />
				</div>
			</div>

			<div>
				<label className='mb-2 block text-sm font-medium'>Avatar</label>
				<div className='relative h-20 w-20 overflow-hidden rounded-full border bg-white/60'>
					<img src='/images/feiying/fying1.jpg' alt='current avatar' className='h-full w-full object-cover' />
				</div>
			</div>
		</div>
	)
}
