import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import {Link} from "react-router-dom";
import {Cell, Legend, Pie, PieChart, ResponsiveContainer} from "recharts";
import React from "react";

export function cn(...inputs) {
    return twMerge(clsx(inputs))
}
