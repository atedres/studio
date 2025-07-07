"use client"

import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AutocompleteInputProps {
    value: string;
    onChange: (value: string) => void;
    suggestions: string[];
    placeholder?: string;
    className?: string;
}

export function AutocompleteInput({ value, onChange, suggestions, placeholder, className }: AutocompleteInputProps) {
    const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (value && value.length > 0) {
            const lowercasedValue = value.toLowerCase();
            const filtered = suggestions.filter(suggestion =>
                suggestion.toLowerCase().includes(lowercasedValue)
            ).slice(0, 5); // Limit to 5 suggestions
            setFilteredSuggestions(filtered);
            setIsOpen(filtered.length > 0 && document.activeElement === inputRef.current);
        } else {
            setFilteredSuggestions([]);
            setIsOpen(false);
        }
    }, [value, suggestions]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleSelect = (suggestion: string) => {
        onChange(suggestion);
        setIsOpen(false);
    };

    return (
        <div className={cn("relative", className)} ref={containerRef}>
            <Input
                ref={inputRef}
                type="text"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                onFocus={() => value && filteredSuggestions.length > 0 && setIsOpen(true)}
                placeholder={placeholder}
                autoComplete="off"
            />
            {isOpen && filteredSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover text-popover-foreground rounded-md border shadow-lg">
                    <div className="flex flex-col gap-1 p-1 max-h-60 overflow-y-auto">
                        {filteredSuggestions.map((suggestion, index) => (
                            <Button
                                key={index}
                                variant="ghost"
                                className="justify-start h-8 px-2 py-1.5 text-sm"
                                onClick={() => handleSelect(suggestion)}
                                type="button"
                            >
                                {suggestion}
                            </Button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
