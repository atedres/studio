
"use client"

import React, { useState, useEffect, useCallback } from "react"
import { db } from "@/lib/firebase"
import { collection, getDocs, addDoc, updateDoc, doc, query, orderBy } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, PlusCircle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

interface DataItem {
    id: string;
    nom: string;
    actif: boolean;
}

interface DataManagementTableProps {
    collectionName: string;
    title: string;
}

export function DataManagementTable({ collectionName, title }: DataManagementTableProps) {
    const [items, setItems] = useState<DataItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newItemName, setNewItemName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const q = query(collection(db, collectionName), orderBy("nom"));
            const querySnapshot = await getDocs(q);
            const dataList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as DataItem[];
            setItems(dataList);
        } catch (error) {
            console.error(`Error fetching ${collectionName}: `, error);
            toast({ variant: "destructive", title: "Erreur", description: `Impossible de charger les données pour ${title}.` });
        } finally {
            setLoading(false);
        }
    }, [collectionName, title, toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleToggleActive = async (item: DataItem) => {
        const itemRef = doc(db, collectionName, item.id);
        try {
            await updateDoc(itemRef, { actif: !item.actif });
            setItems(prevItems => prevItems.map(i => i.id === item.id ? { ...i, actif: !i.actif } : i));
            toast({ title: "Statut mis à jour", description: `"${item.nom}" est maintenant ${!item.actif ? "actif" : "inactif"}.` });
        } catch (error) {
            console.error("Error updating status: ", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de mettre à jour le statut." });
        }
    };

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemName.trim()) {
            toast({ variant: "destructive", title: "Erreur", description: "Le nom ne peut pas être vide." });
            return;
        }
        setIsSubmitting(true);
        try {
            await addDoc(collection(db, collectionName), {
                nom: newItemName,
                actif: true,
            });
            toast({ title: "Succès", description: `"${newItemName}" a été ajouté à ${title}.` });
            setNewItemName("");
            setIsDialogOpen(false);
            fetchData(); // Refresh data
        } catch (error) {
            console.error("Error adding document: ", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible d'ajouter l'élément." });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div>
            <div className="flex justify-end mb-4">
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button><PlusCircle className="mr-2 h-4 w-4" /> Ajouter</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Ajouter à "{title}"</DialogTitle>
                            <DialogDescription>
                                Entrez le nom du nouvel élément que vous souhaitez ajouter à la liste.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleAddItem}>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="name" className="text-right">Nom</Label>
                                    <Input id="name" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className="col-span-3" />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Enregistrer
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nom</TableHead>
                            <TableHead className="w-[100px] text-right">Actif</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            [...Array(5)].map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-4 w-3/4" /></TableCell>
                                    <TableCell className="flex justify-end"><Skeleton className="h-6 w-12" /></TableCell>
                                </TableRow>
                            ))
                        ) : items.length > 0 ? (
                            items.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.nom}</TableCell>
                                    <TableCell className="text-right">
                                        <Switch
                                            checked={item.actif}
                                            onCheckedChange={() => handleToggleActive(item)}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={2} className="h-24 text-center">
                                    Aucun élément trouvé.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
