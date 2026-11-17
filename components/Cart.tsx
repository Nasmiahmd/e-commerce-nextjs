import { Minus, Plus, Trash } from "lucide-react";

export default function Cart() {
    return(
        <div className="w-3/5 flex justify-between mt-2 text-slate-600 text-sm font-bold gap-1 items-center bg-slate-100 h-fit py-3 rounded-lg px-4 ">
                    <div className="flex justify-center items-center gap-2">
                        <input type="checkbox" className="accent-sky-600 w-4 h-4 cursor-pointer" name="selectAll" id="" />
                        <img src="" className="w-10 h-10" alt="" />
                        <h4>Product 1</h4>
                    </div>
                    <div>
                        <p className="w-fit px-1 bg-slate-50 h-fit py-1 rounded-lg">$44.99</p>
                        <div className="flex justify-center items-center flex-col">
                            <button></button>
                            <button className="cursor-pointer mt-1"><Trash color="red"/></button>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-center items-center gap-1">
                            <button className="w-7 h-7 bg-slate-200 flex items-center justify-center rounded-sm hover:ring-1 hover:ring-slate-500 hover:bg-slate-400 cursor-pointer "><Minus/></button>
                            <p className="w-7 h-7 bg-white flex items-center justify-center rounded-sm ">2</p>
                            <button className="w-7 h-7 bg-slate-200 flex items-center justify-center rounded-sm hover:ring-1 hover:ring-slate-500 hover:bg-slate-400 cursor-pointer"><Plus/></button>
                        </div>
                    </div>
                </div>
    )
}