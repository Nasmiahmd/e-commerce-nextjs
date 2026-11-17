import Navbar from "@/components/NavBar"
import { ArrowBigLeft, ArrowLeftIcon, Delete, DeleteIcon, Minus, Plus, Trash, X } from "lucide-react"
import Link from "next/link"

export default function Cart() {

    return (

        <div className="min-h-screen bg-gray-50">
            <Navbar />

            <div className="flex flex-col items-center justify-center mt-4">
                <div className="h-12 w-3/5 bg-gray-200 flex justify-between items-center rounded-md ">
                    <div className=" ms-4">
                        <Link href={'/dashboard'}>
                            <button className="flex w-fit h-fit items-center justify-center gap-2 rounded-xl bg-gray-300 px-1.5 py-1 font-semibold text-red-600 hover:bg-slate-100 hover:ring-1 hover:ring-sky-800 transition"><ArrowLeftIcon color="black" size={18} /></button>
                        </Link>
                    </div>
                    <div className=" flex gap-2 me-4">
                        <button className="flex w-fit h-fit items-center justify-center gap-2 rounded-lg bg-gray-300 px-1.5 py-1 font-semibold text-red-600 hover:bg-red-100 transition  hover:text-red-800 hover:ring-1 hover:ring-red-800 ">Delete</button>
                        <button className="flex w-fit h-fit items-center justify-center gap-2 rounded-lg bg-gray-300 px-1.5 py-1 font-semibold text-green-600 hover:bg-green-100  hover:text-gray-800 hover:ring-1 hover:ring-green-800 transition">Purchase</button>
                    </div>

                </div>
                <div className="w-3/5 flex justify-between mt-2 text-slate-600 text-sm font-bold gap-1 items-center bg-slate-100 h-fit py-3 rounded-lg px-4">
                    <div className="flex gap-1">
                        <input type="checkbox" className="accent-sky-600 w-4 h-4 cursor-pointer" name="selectAll" id="" /><p>Select All</p>
                    </div>
                    <div><Trash /></div>
                </div>
                <Cart />
            </div>
        </div>
    )
}