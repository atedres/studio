
"use client"

import React, { useState, useEffect, useCallback } from "react"
import { db } from "@/lib/firebase"
import { collection, getDocs, addDoc, updateDoc, doc, query, orderBy, deleteDoc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { logActivity } from "@/lib/activityLogger"

import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, PlusCircle, Edit, Trash2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

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
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<DataItem | null>(null);
    const [newItemName, setNewItemName] = useState("");
    const [editedItemName, setEditedItemName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    const { user } = useAuth();

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
            await logActivity(user, `Changement statut de "${title}"`, { name: item.nom, newStatus: !item.actif });
            setItems(prevItems => prevItems.map(i => i.id === item.id ? { ...i, actif: !i.actif } : i));
            toast({ title: "Statut mis à jour", description: `"${item.nom}" est maintenant ${item.actif ? "inactif" : "actif"}.` });
        } catch (error) {
            console.error("Error updating status: ", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de mettre à jour le statut." });
        }
    };

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = newItemName.trim();
        if (!trimmedName) {
            toast({ variant: "destructive", title: "Erreur", description: "Le nom ne peut pas être vide." });
            return;
        }
        
        const isDuplicate = items.some(item => item.nom.toLowerCase() === trimmedName.toLowerCase());
        if (isDuplicate) {
            toast({ variant: "destructive", title: "Erreur", description: `L'élément "${trimmedName}" existe déjà.` });
            return;
        }

        setIsSubmitting(true);
        try {
            await addDoc(collection(db, collectionName), {
                nom: trimmedName,
                actif: true,
            });
            await logActivity(user, `Ajout à "${title}"`, { name: trimmedName });
            toast({ title: "Succès", description: `"${trimmedName}" a été ajouté à ${title}.` });
            setNewItemName("");
            setIsAddDialogOpen(false);
            fetchData(); // Refresh data
        } catch (error) {
            console.error("Error adding document: ", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible d'ajouter l'élément." });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditClick = (item: DataItem) => {
        setEditingItem(item);
        setEditedItemName(item.nom);
        setIsEditDialogOpen(true);
    };
    
    const handleUpdateItem = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = editedItemName.trim();
        if (!editingItem || !trimmedName) {
            toast({ variant: "destructive", title: "Erreur", description: "Le nom ne peut pas être vide." });
            return;
        }

        const isDuplicate = items.some(item => item.id !== editingItem.id && item.nom.toLowerCase() === trimmedName.toLowerCase());
        if (isDuplicate) {
            toast({ variant: "destructive", title: "Erreur", description: `Un autre élément avec le nom "${trimmedName}" existe déjà.` });
            return;
        }

        setIsSubmitting(true);
        const itemRef = doc(db, collectionName, editingItem.id);
        try {
            await updateDoc(itemRef, { nom: trimmedName });
            await logActivity(user, `Modification de "${title}"`, { oldName: editingItem.nom, newName: trimmedName });
            toast({ title: "Succès", description: `L'élément a été renommé en "${trimmedName}".` });
            setEditingItem(null);
            setEditedItemName("");
            setIsEditDialogOpen(false);
            fetchData(); // Refresh data
        } catch (error) {
             console.error("Error updating document: ", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de modifier l'élément." });
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleDeleteItem = async (itemId: string) => {
        const itemToDelete = items.find(i => i.id === itemId);
        if (!itemToDelete) return;

        setIsSubmitting(true);
        const itemRef = doc(db, collectionName, itemId);
        try {
            await deleteDoc(itemRef);
            await logActivity(user, `Suppression de "${title}"`, { name: itemToDelete.nom });
            toast({ title: "Succès", description: "L'élément a été supprimé." });
            fetchData(); // Refresh data
        } catch (error) {
            console.error("Error deleting document: ", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer l'élément." });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div>
            <div className="flex justify-end mb-4">
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
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
                            <TableHead className="w-[100px]">Actif</TableHead>
                            <TableHead className="w-[120px] text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            [...Array(5)].map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-4 w-3/4" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-12" /></TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Skeleton className="h-8 w-8 inline-block" />
                                        <Skeleton className="h-8 w-8 inline-block" />
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : items.length > 0 ? (
                            items.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.nom}</TableCell>
                                    <TableCell>
                                        <Switch
                                            checked={item.actif}
                                            onCheckedChange={() => handleToggleActive(item)}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(item)}>
                                            <Edit className="h-4 w-4" />
                                            <span className="sr-only">Modifier</span>
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                                    <Trash2 className="h-4 w-4" />
                                                    <span className="sr-only">Supprimer</span>
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                <AlertDialogTitle>Êtes-vous sûr de vouloir supprimer ?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Cette action est irréversible. L'élément "{item.nom}" sera définitivement supprimé.
                                                </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                                <AlertDialogAction
                                                    onClick={() => handleDeleteItem(item.id)}
                                                    className={cn(buttonVariants({ variant: "destructive" }))}
                                                    disabled={isSubmitting}
                                                >
                                                   {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Supprimer
                                                </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center">
                                    Aucun élément trouvé.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Modifier "{editingItem?.nom}"</DialogTitle>
                        <DialogDescription>
                            Entrez le nouveau nom pour cet élément.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUpdateItem}>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-name" className="text-right">Nom</Label>
                                <Input id="edit-name" value={editedItemName} onChange={(e) => setEditedItemName(e.target.value)} className="col-span-3" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="secondary" onClick={() => setIsEditDialogOpen(false)}>Annuler</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Enregistrer
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
