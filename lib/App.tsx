import { RouterProvider } from 'react-router-dom'
import HotelProvider from './components/HotelProvider'
import { router } from './router'

export default function App() {
  return (
    <HotelProvider>
      <RouterProvider router={router} />
    </HotelProvider>
  )
}