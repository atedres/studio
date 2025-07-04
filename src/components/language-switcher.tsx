"use client"

import * as React from "react"
import { Check, Languages } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function LanguageSwitcher() {
  const [currentLang, setCurrentLang] = React.useState("fr")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Languages className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Changer de langue</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setCurrentLang("fr")}>
          <Check className={cn("mr-2 h-4 w-4", currentLang === "fr" ? "opacity-100" : "opacity-0")} />
          Français
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setCurrentLang("ar")}>
          <Check className={cn("mr-2 h-4 w-4", currentLang === "ar" ? "opacity-100" : "opacity-0")} />
          العربية
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
